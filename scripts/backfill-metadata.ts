import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { prisma } from "@/lib/prisma";
import { getTmdbMovie, searchTmdbMovie, toMovieMetadata } from "@/lib/tmdb";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
config({path:path.join(root,".env.local")});config({path:path.join(root,".env")});

async function main(){
  const movies=await prisma.movie.findMany({where:{tmdbId:{not:null},OR:[{directors:null},{cast:null},{tmdbRating:null},{releaseDate:null}]},select:{id:true,tmdbId:true,title:true,year:true}});
  let updated=0,failed=0;
  for(let index=0;index<movies.length;index+=8){
    const batch=movies.slice(index,index+8);
    await Promise.all(batch.map(async(movie)=>{try{let details=await getTmdbMovie(movie.tmdbId!);const returnedYear=details.release_date?Number(details.release_date.slice(0,4)):null;if(movie.year&&returnedYear&&movie.year!==returnedYear){const corrected=await searchTmdbMovie(movie.title,movie.year);if(corrected)details=await getTmdbMovie(corrected.id);}const metadata=toMovieMetadata(details);await prisma.movie.update({where:{id:movie.id},data:{tmdbId:metadata.tmdbId,releaseDate:metadata.releaseDate,directors:metadata.directors,cast:metadata.cast,tmdbRating:metadata.tmdbRating,tmdbVoteCount:metadata.tmdbVoteCount,imdbId:metadata.imdbId}});updated+=1;}catch(error){failed+=1;console.warn(`Metadata skipped for ${movie.title}: ${error instanceof Error?error.message:"unknown error"}`);}}));
    console.log(`Metadata progress: ${Math.min(index+batch.length,movies.length)}/${movies.length}`);
  }
  console.log(`Metadata backfill complete: ${updated} updated, ${failed} skipped.`);
}
main().catch((error)=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());

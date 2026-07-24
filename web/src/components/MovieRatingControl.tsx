"use client";

import { apiFetch } from "@/lib/api";
import { useState } from "react";
import StarRating from "./StarRating";
import { useToast } from "./ToastProvider";
import { useAuth } from "./AuthProvider";

export default function MovieRatingControl({ movieId, initialRating }: { movieId: string; initialRating: number | null }) {
  const [rating,setRating]=useState(initialRating);
  const [saving,setSaving]=useState(false);
  const {notify}=useToast();
  const { user } = useAuth();

  if (!user) {
    return <StarRating value={initialRating} readOnly size="lg" showValue />;
  }

  async function update(value:number){const previous=rating;setRating(value);setSaving(true);try{const response=await apiFetch("/movies",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({movieId,action:"rating",value})});const payload=await response.json() as {message?:string;error?:string};if(!response.ok)throw new Error(payload.error??"Não foi possível salvar a nota.");notify(payload.message??"Nota salva.");}catch(error){setRating(previous);notify(error instanceof Error?error.message:"Não foi possível salvar a nota.","error");}finally{setSaving(false);}}
  return <div className={saving?"opacity-60":""}><StarRating value={rating} onChange={update} size="lg" showValue /></div>;
}

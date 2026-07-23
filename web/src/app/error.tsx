"use client";

export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}) {
  return <main className="page-shell"><div className="empty-state mx-auto max-w-2xl"><p className="eyebrow !text-red-300">O projetor parou</p><h1 className="mt-3 text-3xl font-black text-white">Não foi possível carregar esta visualização.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Seus dados estão seguros. Tente a solicitação novamente ou retorne pela navegação.</p><button type="button" onClick={reset} className="accent-button mt-6">Tentar novamente</button></div></main>;
}

export async function findActiveWorkRow(supabase,ownerId){
  return supabase.from('atelier_works')
    .select('*')
    .eq('owner_id',ownerId)
    .eq('status','active')
    .maybeSingle();
}

export async function createActiveWorkRow(supabase,{ownerId,displayName,totalWorkSeconds}){
  return supabase.from('atelier_works')
    .insert({
      owner_id:ownerId,
      display_name:displayName,
      status:'active',
      total_work_seconds:Math.floor(totalWorkSeconds)
    })
    .select()
    .single();
}

export async function uploadArtworkFile(supabase,{ownerId,workId,dataUrl}){
  const blob=await fetch(dataUrl).then(r=>r.blob());
  const ext=blob.type==='image/png'?'png':(blob.type==='image/webp'?'webp':'jpg');
  const path=`${ownerId}/${workId}/${Date.now()}.${ext}`;
  const {error}=await supabase.storage.from('atelier-artworks').upload(path,blob,{
    contentType:blob.type||'image/jpeg',
    cacheControl:'3600',
    upsert:false
  });
  if(error)throw error;
  const {data}=supabase.storage.from('atelier-artworks').getPublicUrl(path);
  return {path,url:data.publicUrl};
}

export async function completeWorkRow(supabase,{workId,ownerId,totalWorkSeconds,coverImageUrl}){
  return supabase.from('atelier_works')
    .update({
      status:'completed',
      completed_at:new Date().toISOString(),
      total_work_seconds:Math.floor(totalWorkSeconds),
      cover_image_url:coverImageUrl
    })
    .eq('id',workId)
    .eq('owner_id',ownerId);
}

export async function fetchHistoryBundle(supabase,{ownerId,workId,workDate}){
  const [historyRes,dailyRes,completedRes]=await Promise.all([
    workId
      ? supabase.from('atelier_artwork_history').select('*').eq('work_id',workId).order('created_at',{ascending:true}).limit(12)
      : Promise.resolve({data:[],error:null}),
    supabase.from('atelier_daily_work').select('*').eq('owner_id',ownerId).eq('work_date',workDate).maybeSingle(),
    supabase.from('atelier_works').select('*').eq('owner_id',ownerId).eq('status','completed').order('completed_at',{ascending:false}).limit(50)
  ]);
  return {historyRes,dailyRes,completedRes};
}

export async function fetchWorkById(supabase,workId){
  return supabase.from('atelier_works')
    .select('id,owner_id,status,cover_image_url,completed_at,total_work_seconds')
    .eq('id',workId)
    .maybeSingle();
}

export async function fetchCompletedWorks(supabase,ownerId){
  return supabase.from('atelier_works')
    .select('id,cover_image_url,completed_at,total_work_seconds')
    .eq('owner_id',ownerId)
    .eq('status','completed')
    .order('completed_at',{ascending:false})
    .limit(50);
}

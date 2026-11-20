export async function getLikeCount(supabase,workId){
  return supabase.from('atelier_likes')
    .select('*',{count:'exact',head:true})
    .eq('work_id',workId);
}

export async function getUserLike(supabase,workId,userId){
  return supabase.from('atelier_likes')
    .select('work_id')
    .eq('work_id',workId)
    .eq('user_id',userId)
    .maybeSingle();
}

export async function addLike(supabase,workId,userId){
  return supabase.from('atelier_likes').insert({work_id:workId,user_id:userId});
}

export async function removeLike(supabase,workId,userId){
  return supabase.from('atelier_likes')
    .delete()
    .eq('work_id',workId)
    .eq('user_id',userId);
}

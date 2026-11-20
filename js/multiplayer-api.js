export async function fetchWorldState(supabase){
  const [
    {data:easels,error:easelError},
    {data:artworks,error:artworkError},
    {data:presence,error:presenceError}
  ]=await Promise.all([
    supabase.from('atelier_easels').select('*').order('seat_index'),
    supabase.from('atelier_artworks').select('*').order('seat_index'),
    supabase.from('atelier_presence').select('*')
  ]);
  return {easels,artworks,presence,easelError,artworkError,presenceError};
}

export async function claimEasel(supabase,seatIndex,clientId){
  return supabase.rpc('atelier_claim_easel',{p_seat_index:seatIndex,p_client_id:clientId});
}

export async function releaseEasel(supabase,seatIndex,clientId){
  return supabase.rpc('atelier_release_easel',{p_seat_index:seatIndex,p_client_id:clientId});
}

export async function heartbeatEasel(supabase,seatIndex,clientId){
  return supabase.rpc('atelier_heartbeat',{p_seat_index:seatIndex,p_client_id:clientId});
}

export async function upsertPresence(supabase,row){
  return supabase.from('atelier_presence').upsert(row);
}

export async function fetchPresence(supabase){
  return supabase.from('atelier_presence').select('*');
}

export async function deletePresence(supabase,clientId){
  return supabase.from('atelier_presence').delete().eq('client_id',clientId);
}

export async function adoptGuestData(supabase,guestId){
  return supabase.rpc('atelier_adopt_guest_data',{p_guest_id:guestId});
}

export async function fetchProfile(supabase,userId){
  return supabase.from('atelier_profiles')
    .select('*')
    .eq('user_id',userId)
    .maybeSingle();
}

export async function updateProfileName(supabase,userId,displayName){
  return supabase.from('atelier_profiles')
    .update({display_name:displayName})
    .eq('user_id',userId);
}

export async function createProfile(supabase,userId,displayName){
  return supabase.from('atelier_profiles')
    .insert({user_id:userId,display_name:displayName});
}

export async function getAuthSession(supabase){
  return supabase.auth.getSession();
}

export async function sendMagicLink(supabase,{email,redirectTo}){
  return supabase.auth.signInWithOtp({
    email,
    options:{shouldCreateUser:true,emailRedirectTo:redirectTo}
  });
}

export async function signOut(supabase){
  return supabase.auth.signOut();
}

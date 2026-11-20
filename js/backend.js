import {createClient} from '@supabase/supabase-js';

export const SUPABASE_URL='https://uuotlmljzvludygzrvvt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_QXfhaLNfkXUs13Pe8u7wYQ_V9F2low4';

export const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

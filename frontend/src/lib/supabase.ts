import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function saveSearchQuery(searchData: {
  origin: string;
  destination: string;
  date: string;
  mode: string;
  travellers: string;
}) {
  if (supabaseUrl.includes('placeholder.supabase.co')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('searches')
      .insert([
        {
          origin: searchData.origin,
          destination: searchData.destination,
          date: searchData.date,
          mode: searchData.mode,
          travellers: searchData.travellers,
        }
      ]);
      
    if (error) {
      console.error('Error saving search query:', error);
    }
  } catch (err: any) {
    // Only log if it's not the default placeholder failing to resolve
    if (!supabaseUrl.includes('placeholder.supabase.co')) {
      console.error('Failed to log search to Supabase', err);
    }
  }
}

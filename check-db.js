import { createClient } from '@supabase/supabase-js';
// using node --env-file

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function check() {
  console.log('Checking connection to:', process.env.VITE_SUPABASE_URL);
  
  // Fetch recent outbound messages to see if they failed
  const { data: messages, error: mError } = await supabase.from('messages')
    .select('id, message_type, content, status')
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (mError) {
    console.error('Messages table error:', mError);
  } else {
    console.log('Recent outbound messages:');
    console.table(messages);
  }
}

check();

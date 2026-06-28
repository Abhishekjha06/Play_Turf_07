import { getSupabase } from "../supabase";
import { uid } from "./core";

export interface FeedbackPayload {
  name: string;
  email: string;
  category: string;
  message: string;
  screenshot_url?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  app_version?: string;
  screen_width?: number;
  screen_height?: number;
  page_url?: string;
}

export async function submitFeedback(payload: FeedbackPayload, userGetter: () => Promise<any>) {
  const supabase = await getSupabase();
  const user = await userGetter();
  
  const userId = user?.user_id || user?.id || null;
  const isValidUUID = typeof userId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  
  const { data, error } = await supabase
    .from("feedbacks")
    .insert({
      ...payload,
      user_id: isValidUUID ? userId : null,
      status: "Open"
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadScreenshot(file: File): Promise<string> {
  const supabase = await getSupabase();
  const fileExt = file.name.split('.').pop();
  const fileName = `${uid("scr")}.${fileExt}`;
  const filePath = `feedback/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("feedback_screenshots")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("feedback_screenshots")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

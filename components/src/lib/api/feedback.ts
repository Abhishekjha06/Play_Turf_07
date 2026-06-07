import { getSupabase } from "../supabase";
import { USE_MOCK, delay, uid, http } from "./core";

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
  
  if (supabase) {
    const { data, error } = await supabase
      .from("feedbacks")
      .insert({
        ...payload,
        user_id: user?.user_id || user?.id || null,
        status: "Open"
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  
  if (USE_MOCK) {
    await delay(300);
    console.log("Mock Feedback Submitted:", payload);
    return { id: uid("fbk"), ...payload, status: "Open", created_at: new Date().toISOString() };
  }
  
  return http("/feedback", { method: "POST", body: JSON.stringify(payload) });
}

export async function uploadScreenshot(file: File): Promise<string> {
  const supabase = await getSupabase();
  if (supabase) {
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
  
  // Mock upload (data URL)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

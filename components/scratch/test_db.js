import { createClient } from "@supabase/supabase-js";

const url = "https://yueilrhdifsvxwacvvya.supabase.co";
const key = "sb_publishable_uryvLM0KpsZeUJLfbaI8-Q_D0SyNur8";

const supabase = createClient(url, key);

async function run() {
    try {
        console.log("Fetching policies...");
        const { data, error } = await supabase.rpc("exec_sql", {
            sql_query: "SELECT * FROM pg_policies WHERE tablename = 'open_games';"
        });
        if (error) {
            // If RPC doesn't exist, we can try querying via normal select if we have a view or run an RPC
            console.error("Error fetching policies:", error);
            // Let's do a direct select on a catalog if allowed, or check what else
            const { data: data2, error: err2 } = await supabase.from("pg_policies").select("*");
            console.log("Direct catalog select:", data2, err2);
        } else {
            console.log("Policies:", data);
        }
    } catch (e) {
        console.error("Exception occurred:", e);
    }
}

run();

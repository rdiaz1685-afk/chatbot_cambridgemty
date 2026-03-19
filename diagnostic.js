const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function check() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) { console.log("No hay key"); return; }
  
  // Probamos llamar a la API de listado directamente vía fetch 
  // porque el SDK a veces oculta el error real
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const resp = await fetch(url);
    const data = await resp.json();
    
    if (data.error) {
      console.log("❌ ERROR DE GOOGLE:", data.error.message);
      console.log("Status:", data.error.status);
    } else {
      console.log("✅ MODELOS DISPONIBLES:");
      data.models?.forEach(m => console.log("- " + m.name.replace('models/', '')));
    }
  } catch (e) {
    console.log("Error de red:", e.message);
  }
}
check();

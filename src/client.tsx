import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./app";
import { Providers } from "@/providers";
import OAuthCallbackPage from "@/components/oauth/OAuthCallbackPage";

const root = createRoot(document.getElementById("app")!);

root.render(
  <StrictMode>
    <Providers>
      <div className="bg-neutral-50 text-base text-neutral-900 antialiased transition-colors selection:bg-blue-700 selection:text-white dark:bg-neutral-950 dark:text-neutral-100">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          </Routes>
        </BrowserRouter>
      </div>
    </Providers>
  </StrictMode>
);

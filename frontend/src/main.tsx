import "./polyfills";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "@/components/theme-provider";
import { SolanaProvider } from "@/components/solana-provider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="light">
      <SolanaProvider>
        <App />
      </SolanaProvider>
    </ThemeProvider>
  </React.StrictMode>
);

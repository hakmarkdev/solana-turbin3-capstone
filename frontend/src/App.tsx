import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import { Home } from "@/pages/Home";
import { Orders } from "@/pages/Orders";
import { CreateOrder } from "@/pages/CreateOrder";
import { OrderDetail } from "@/pages/OrderDetail";
import { Admin } from "@/pages/Admin";

export function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="container flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:address" element={<OrderDetail />} />
            <Route path="/create" element={<CreateOrder />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
        <footer className="border-t py-6">
          <div className="container flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
            <span>StableCart: USDC escrow on Solana</span>
            <span className="font-mono text-xs">devnet</span>
          </div>
        </footer>
      </div>
      <Toaster />
    </BrowserRouter>
  );
}

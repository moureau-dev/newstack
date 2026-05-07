import type NewstackNode from "@moureau/newstack";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function Layout({ children }: { children?: NewstackNode }) {
  return (
    <div class="min-h-screen flex flex-col">
      <Navbar />

      <div class="flex-1 px-6 py-4">{children}</div>

      <Footer />
    </div>
  );
}

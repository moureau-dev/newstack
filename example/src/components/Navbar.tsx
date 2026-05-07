import Newstack from "@moureau/newstack";

export class Navbar extends Newstack {
  render() {
    return (
      <nav class="flex items-center gap-6 px-6 py-3 border-b border-zinc-700 text-sm">
        <span class="font-bold tracking-tight">Newstack</span>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
    );
  }
}

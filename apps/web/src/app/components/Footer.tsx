export default function Footer() {
  return (
    <footer className="px-8 py-8">
      <div className="max-w-6xl mx-auto text-center text-slate-400">
        © {new Date().getFullYear()} Clause Genie — Session context is ephemeral. Privacy first.
      </div>
    </footer>
  );
}
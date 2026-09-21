import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const links = [
  { label: "Benefícios", href: "#beneficios" },
  { label: "Como Funciona", href: "#como-funciona" },
  { label: "Segmentos", href: "#segmentos" },
  { label: "Planos", href: "#planos" },
  
  { label: "Afilie-se", href: "/afiliados", highlight: true },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleClick = (href: string) => {
    setOpen(false);
    if (href.startsWith("/")) {
      navigate(href);
    } else {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-16">
          <a href="/" className="text-2xl font-extrabold font-display text-gradient-hero tracking-tight">
            N<span className="text-secondary" style={{ WebkitTextFillColor: "hsl(var(--secondary))" }}>O</span>OV
          </a>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <button
                key={l.href}
                onClick={() => handleClick(l.href)}
                className={`text-sm font-medium transition-colors ${
                  (l as any).highlight
                    ? "font-bold text-accent hover:text-accent/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" className="text-sm font-semibold text-foreground" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button className="bg-gradient-cta text-accent-foreground text-sm font-bold rounded-lg border-0" onClick={() => navigate("/cadastro")}>
              Criar Loja Grátis
            </Button>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setOpen(!open)} className="md:hidden text-foreground">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-background border-b border-border overflow-hidden"
            >
              <div className="container py-4 space-y-3">
                {links.map((l) => (
                  <button
                    key={l.href}
                    onClick={() => handleClick(l.href)}
                    className={`block text-sm font-medium text-left w-full ${
                      (l as any).highlight
                        ? "font-bold text-accent"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
                <Button variant="ghost" className="w-full text-sm font-semibold" onClick={() => { setOpen(false); navigate("/login"); }}>
                  Entrar
                </Button>
                <Button className="w-full bg-gradient-cta text-accent-foreground font-bold border-0" onClick={() => { setOpen(false); navigate("/cadastro"); }}>
                  Criar Loja Grátis
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="h-[2px] bg-secondary" />
    </nav>
  );
};

export default Navbar;

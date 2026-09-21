import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION, APP_MAJOR, APP_MINOR } from "@/lib/version";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RemoteVersion {
  major: number;
  minor: number;
  updated_at: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

const REOPEN_VERSION_DIALOG_KEY = "reopen_version_dialog";
const HARD_REFRESH_QUERY_PARAM = "noov_refresh";
const APP_CACHE_PREFIX = "noov-pwa-";

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const isAppCache = (cacheName: string) =>
  cacheName.startsWith(APP_CACHE_PREFIX) ||
  /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(cacheName);
type Platform =
  | "windows"
  | "mac"
  | "android"
  | "ios"
  | "linux"
  | "pwa-android"
  | "pwa-ios"
  | "pwa-desktop"
  | "unknown";

const detectPlatform = (): { platform: Platform; label: string } => {
  if (typeof window === "undefined") return { platform: "unknown", label: "seu dispositivo" };
  const ua = navigator.userAgent || "";
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari standalone flag
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const isAndroid = /Android/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
  const isWindows = /Windows/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

  if (isStandalone) {
    if (isIOS) return { platform: "pwa-ios", label: "App instalado (iPhone / iPad)" };
    if (isAndroid) return { platform: "pwa-android", label: "App instalado (Android)" };
    return { platform: "pwa-desktop", label: "App instalado (Desktop)" };
  }
  if (isIOS) return { platform: "ios", label: "iPhone / iPad (Safari)" };
  if (isAndroid) return { platform: "android", label: "Android (Chrome)" };
  if (isMac) return { platform: "mac", label: "Mac (Chrome, Safari, Edge)" };
  if (isWindows) return { platform: "windows", label: "Windows (Chrome, Edge, Firefox)" };
  if (isLinux) return { platform: "linux", label: "Linux (Chrome, Firefox)" };
  return { platform: "unknown", label: "seu dispositivo" };
};

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">{children}</kbd>
);

function PlatformRefreshInstructions() {
  const { platform } = detectPlatform();

  const content = (() => {
    switch (platform) {
      case "windows":
      case "linux":
        return (
          <p>
            Pressione <Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>R</Kbd> para forçar o recarregamento sem usar o cache do navegador.
          </p>
        );
      case "mac":
        return (
          <p>
            Pressione <Kbd>⌘ Cmd</Kbd> + <Kbd>Shift</Kbd> + <Kbd>R</Kbd> para forçar o recarregamento sem usar o cache do navegador.
          </p>
        );
      case "android":
        return (
          <p>
            Toque nos três pontinhos <span className="font-mono">⋮</span> → <i>Histórico</i> → <i>Limpar dados de navegação</i> → marque <i>Imagens e arquivos em cache</i> e confirme. Depois recarregue esta página.
          </p>
        );
      case "ios":
        return (
          <p>
            Abra <i>Ajustes</i> → <i>Safari</i> → <i>Limpar Histórico e Dados dos Sites</i> e confirme. Depois volte e recarregue esta página.
          </p>
        );
      case "pwa-android":
        return (
          <p>
            Feche o app por completo (remova da lista de apps recentes) e abra novamente. Se continuar antigo, vá em <i>Ajustes do celular</i> → <i>Apps</i> → <b>NOOV</b> → <i>Armazenamento</i> → <i>Limpar cache</i>.
          </p>
        );
      case "pwa-ios":
        return (
          <p>
            Feche o app por completo (arraste para cima na lista de apps abertos) e abra novamente. Se continuar antigo, desinstale o ícone da tela inicial e reinstale pelo Safari.
          </p>
        );
      case "pwa-desktop":
        return (
          <p>
            Feche a janela do app e abra novamente. Se continuar antigo, desinstale pelo menu <span className="font-mono">⋮</span> → <i>Desinstalar NOOV</i> e reinstale pelo navegador.
          </p>
        );
      default:
        return (
          <p>
            Recarregue a página ignorando o cache do navegador (geralmente <Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>Shift</Kbd> + <Kbd>R</Kbd>).
          </p>
        );
    }
  })();

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-semibold text-foreground">
        Se após atualizar continuar na versão antiga, force a atualização:
      </p>
      <div className="text-[11px] text-muted-foreground leading-relaxed space-y-1">
        {content}
      </div>

    </div>
  );
}


/**
 * Compara a versão local do bundle (APP_VERSION) com a versão publicada
 * mais recente registrada no backend (tabela app_version).
 */
export function VersionCheckDialog({ open, onOpenChange }: Props) {
  const [remote, setRemote] = useState<RemoteVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { data, error } = await supabase
        .from("app_version")
        .select("major, minor, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setError("Não foi possível consultar a versão mais recente.");
      } else if (data) {
        setRemote(data as RemoteVersion);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const remoteUpdated = remote ? new Date(remote.updated_at) : null;
  const getBrParts = (d: Date) => {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      year: "numeric",
    }).formatToParts(d);
    const day = parts.find((p) => p.type === "day")?.value ?? "--";
    const year = parts.find((p) => p.type === "year")?.value ?? "----";
    return { day, year2: year.slice(-2) };
  };
  const remoteVersionStr = remote
    ? (() => {
        if (!remoteUpdated) return `${remote.major}.${remote.minor}.----`;
        const { day, year2 } = getBrParts(remoteUpdated);
        return `${remote.major}.${remote.minor}.${day}${year2}`;
      })()
    : null;

  const isOutdated =
    remote != null &&
    (remote.major > APP_MAJOR || (remote.major === APP_MAJOR && remote.minor > APP_MINOR));

  const handleReload = async () => {
    setRefreshing(true);

    // Sinaliza antes de qualquer limpeza para reabrir o dialog após a navegação.
    try {
      localStorage.setItem(REOPEN_VERSION_DIALOG_KEY, "1");
    } catch {
      /* silencioso */
    }

    // 1) Desregistra service workers antigos que podem estar servindo bundles em cache.
    try {
      if ("serviceWorker" in navigator) {
        const regs = await withTimeout(navigator.serviceWorker.getRegistrations(), 2000);
        if (regs?.length) {
          await withTimeout(
            Promise.allSettled(regs.map((registration) => registration.unregister())),
            3000,
          );
        }
      }
    } catch {
      /* silencioso */
    }

    // 2) Limpa caches do app. Isso reproduz o efeito prático do Ctrl+Shift+R para o PWA.
    try {
      if ("caches" in window) {
        const keys = await withTimeout(caches.keys(), 2000);
        const appCacheKeys = keys?.filter(isAppCache) ?? [];
        if (appCacheKeys.length) {
          await withTimeout(
            Promise.allSettled(appCacheKeys.map((cacheKey) => caches.delete(cacheKey))),
            3000,
          );
        }
      }
    } catch {
      /* silencioso */
    }

    // 3) Limpa cache de sessão sem tocar no login salvo em localStorage.
    try {
      sessionStorage.clear();
    } catch {
      /* silencioso */
    }

    // 4) Faz uma requisição no-store/no-cache antes da navegação para revalidar o HTML.
    const freshUrl = new URL(window.location.href);
    freshUrl.searchParams.delete("v");
    freshUrl.searchParams.delete("pwa-update");
    freshUrl.searchParams.delete("sw-cleanup");
    freshUrl.searchParams.set(HARD_REFRESH_QUERY_PARAM, Date.now().toString());

    try {
      await withTimeout(
        fetch(freshUrl.toString(), {
          cache: "reload",
          credentials: "same-origin",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        }).then((response) => response.text()),
        3000,
      );
    } catch {
      /* silencioso */
    }

    window.location.replace(freshUrl.toString());

  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Status da versão</DialogTitle>
          <DialogDescription>
            Compare a versão instalada no seu navegador com a versão publicada mais recente.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-sm text-destructive py-4">{error}</div>
        ) : (
          <div className="space-y-4 py-2">
            {isOutdated ? (
              <div className="flex items-start gap-3 rounded-lg border border-red-400 bg-red-50 p-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm text-red-900">
                  <p className="font-semibold">Versão desatualizada</p>
                  <p className="text-xs mt-0.5">
                    Existe uma versão mais recente publicada. Clique em <b>Atualizar agora</b> para
                    recarregar a página e buscar a versão nova.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-900">
                  <p className="font-semibold">Você está na versão mais recente</p>
                  <p className="text-xs mt-0.5">Tudo em dia — nenhuma atualização pendente.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Sua versão</div>
                <div className="text-lg font-bold tabular-nums text-foreground mt-1">{APP_VERSION}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Instalada neste sistema</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Última Atualização</div>
                <div className="text-lg font-bold tabular-nums text-foreground mt-1">
                  {remoteVersionStr ?? "—"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {remoteUpdated
                    ? remoteUpdated.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })
                    : "—"}
                </div>
              </div>
            </div>

            <PlatformRefreshInstructions />

          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleReload} className="gap-2" disabled={refreshing}>
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

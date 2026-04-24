import { WarningCircle as AlertCircle, Download } from "@phosphor-icons/react";
import { platform } from "@tauri-apps/plugin-os";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/ui/button";
import { getApiBase } from "@/utils/api-base";
import { useDesktopSignIn } from "@/features/window/hooks/use-desktop-sign-in";
import { useAuthStore } from "@/features/window/stores/auth-store";
import { useGitHubStore } from "../stores/github-store";

function getInstallHint(): { label: string; action: () => void } {
  const os = platform();

  if (os === "macos") {
    return {
      label: "brew install gh",
      action: () => void openUrl("https://github.com/cli/cli#macos"),
    };
  }
  if (os === "windows") {
    return {
      label: "winget install GitHub.cli",
      action: () => void openUrl("https://github.com/cli/cli#windows"),
    };
  }
  return {
    label: "Install GitHub CLI",
    action: () => void openUrl("https://github.com/cli/cli#linux--bsd"),
  };
}

export function GitHubCliStatusMessage() {
  const cliStatus = useGitHubStore((s) => s.cliStatus);
  const githubAccountStatus = useGitHubStore((s) => s.githubAccountStatus);
  const checkAuth = useGitHubStore((s) => s.actions.checkAuth);
  const isAthasAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { signIn, isSigningIn } = useDesktopSignIn({
    onSuccess: () => void checkAuth({ force: true }),
  });
  const install = getInstallHint();

  const retry = () => void checkAuth({ force: true });
  const openGitHubConnection = () =>
    void openUrl(`${getApiBase()}/dashboard/settings/integrations`);

  if (cliStatus === "notInstalled") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border/60 bg-secondary-bg/60 p-4 text-center">
        <Download className="mb-2 text-text-lighter" />
        <p className="ui-text-sm text-text">GitHub CLI not installed</p>
        <p className="ui-text-sm mt-1 text-text-lighter">
          Install it with <code className="rounded bg-hover px-1 py-0.5">{install.label}</code>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Button
            onClick={install.action}
            variant="ghost"
            size="xs"
            className="h-auto px-0 text-accent hover:bg-transparent hover:text-accent/80"
            aria-label="Open install instructions"
          >
            Install guide
          </Button>
          <span className="text-border">|</span>
          <Button
            onClick={retry}
            variant="ghost"
            size="xs"
            className="h-auto px-0 text-accent hover:bg-transparent hover:text-accent/80"
            aria-label="Retry"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!isAthasAuthenticated || githubAccountStatus === "notSignedIn") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border/60 bg-secondary-bg/60 p-4 text-center">
        <AlertCircle className="mb-2 text-text-lighter" />
        <p className="ui-text-sm text-text">GitHub CLI not authenticated</p>
        <p className="ui-text-sm mt-1 text-text-lighter">
          Sign in to Athas to use your connected GitHub account.
        </p>
        <Button
          onClick={() => void signIn().catch(() => undefined)}
          variant="ghost"
          size="xs"
          disabled={isSigningIn}
          className="mt-2 h-auto px-0 text-accent hover:bg-transparent hover:text-accent/80"
          aria-label="Sign in to Athas"
        >
          {isSigningIn ? "Signing in..." : "Sign in"}
        </Button>
      </div>
    );
  }

  if (githubAccountStatus === "notConnected") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border/60 bg-secondary-bg/60 p-4 text-center">
        <AlertCircle className="mb-2 text-text-lighter" />
        <p className="ui-text-sm text-text">GitHub account not connected</p>
        <p className="ui-text-sm mt-1 text-text-lighter">
          Connect GitHub in Athas, then retry this view.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Button
            onClick={openGitHubConnection}
            variant="ghost"
            size="xs"
            className="h-auto px-0 text-accent hover:bg-transparent hover:text-accent/80"
            aria-label="Connect GitHub"
          >
            Connect GitHub
          </Button>
          <span className="text-border">|</span>
          <Button
            onClick={retry}
            variant="ghost"
            size="xs"
            className="h-auto px-0 text-accent hover:bg-transparent hover:text-accent/80"
            aria-label="Retry authentication check"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border/60 bg-secondary-bg/60 p-4 text-center">
      <AlertCircle className="mb-2 text-text-lighter" />
      <p className="ui-text-sm text-text">GitHub CLI not authenticated</p>
      <p className="ui-text-sm mt-1 text-text-lighter">
        Run <code className="rounded bg-hover px-1 py-0.5">gh auth login</code> in terminal
      </p>
      <Button
        onClick={retry}
        variant="ghost"
        size="xs"
        className="mt-2 h-auto px-0 text-accent hover:bg-transparent hover:text-accent/80"
        aria-label="Retry authentication check"
      >
        Retry
      </Button>
    </div>
  );
}

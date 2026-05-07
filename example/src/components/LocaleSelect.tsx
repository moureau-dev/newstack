import Newstack, { type NewstackClientContext } from "@moureau/newstack";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "es-ES", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "pt-BR", label: "Português" },
];

/**
 * @description
 * Demonstrates page.locale — switching locale updates <html lang> and
 * the og:locale meta tag live without a page reload.
 */
export class LocaleSelect extends Newstack {
  render({ page }: NewstackClientContext) {
    return (
      <div class="py-8 px-2 border-t-2" id="locale-select-component">
        <h2 class="font-bold">Locale Select</h2>

        <p>
          Current locale: <strong>{page.locale || "en"}</strong>. Switching
          updates <code>{"<html lang>"}</code> and{" "}
          <code>{"og:locale"}</code> live. Check DevTools.
        </p>

        <div class="flex gap-2 mt-2 flex-wrap">
          {LOCALES.map(({ code, label }) => (
            <button
              type="button"
              class="border px-3 py-1"
              onclick={() => {
                page.locale = code;
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }
}

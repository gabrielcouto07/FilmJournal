import SwiftUI

/// Paleta espelhada do web (`src/app/globals.css`, tema "cinema" escuro por padrão — o web
/// hoje força `color-scheme: dark` incondicionalmente, então replicamos isso como o padrão do
/// app também). `accent`/`accentStrong` são os tons neutros; a cor de destaque real do usuário
/// vem de `AppSettings.accentColor` (`Color(hex:)`) e sobrescreve `accent` via `.tint(...)`.
public extension Color {
    /// `--canvas` — fundo principal.
    static let fjCanvas = Color(hex: "#0a0a0a")
    /// `--canvas-soft` — variação um pouco mais clara do fundo.
    static let fjCanvasSoft = Color(hex: "#111111")

    /// `--surface-1/2/3` — camadas de cartão/painel sobre o fundo, da mais transparente à mais opaca.
    static let fjSurface1 = Color(red: 22 / 255, green: 20 / 255, blue: 16 / 255, opacity: 0.82)
    static let fjSurface2 = Color(red: 30 / 255, green: 27 / 255, blue: 20 / 255, opacity: 0.9)
    static let fjSurface3 = Color(hex: "#22201a")

    /// `--line`/`--line-strong` — bordas sutis (branco quente em baixa opacidade).
    static let fjLine = Color(red: 255 / 255, green: 245 / 255, blue: 221 / 255, opacity: 0.1)
    static let fjLineStrong = Color(red: 255 / 255, green: 245 / 255, blue: 221 / 255, opacity: 0.18)

    /// `--text`/`--text-soft`/`--muted` — texto primário, secundário e terciário.
    static let fjText = Color(hex: "#f7f5f0")
    static let fjTextSoft = Color(hex: "#c8c2b4")
    static let fjMuted = Color(hex: "#8c857e")

    /// `--accent`/`--accent-strong`/`--amber` — dourado de marca (padrão; usuário pode trocar).
    static let fjAccent = Color(hex: "#f5c518")
    static let fjAccentStrong = Color(hex: "#ffd60a")
    static let fjAmber = Color(hex: "#f8c970")

    /// Cores de destaque secundárias (`--blue`/`--violet`/`--danger`).
    static let fjBlue = Color(hex: "#74b9ff")
    static let fjViolet = Color(hex: "#b79cff")
    static let fjDanger = Color(hex: "#ff7c86")

    /// Alias mantido por compatibilidade — mesmo valor de `fjAccent`.
    static let filmJournalDefaultAccent = fjAccent

    /// Constrói uma cor a partir de um hex `#RRGGBB`; cai para `.accentColor` se inválido.
    init(hex: String) {
        var sanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        sanitized.removeAll { $0 == "#" }
        guard sanitized.count == 6, let value = UInt64(sanitized, radix: 16) else {
            self = .accentColor
            return
        }
        let red = Double((value & 0xFF0000) >> 16) / 255
        let green = Double((value & 0x00FF00) >> 8) / 255
        let blue = Double(value & 0x0000FF) / 255
        self = Color(red: red, green: green, blue: blue)
    }
}

#Preview("Paleta cinema") {
    VStack(spacing: 0) {
        ForEach([
            ("canvas", Color.fjCanvas), ("canvasSoft", Color.fjCanvasSoft),
            ("surface1", Color.fjSurface1), ("surface2", Color.fjSurface2), ("surface3", Color.fjSurface3),
            ("accent", Color.fjAccent), ("accentStrong", Color.fjAccentStrong), ("amber", Color.fjAmber),
            ("blue", Color.fjBlue), ("violet", Color.fjViolet), ("danger", Color.fjDanger),
        ], id: \.0) { name, color in
            HStack {
                Text(name).foregroundStyle(Color.fjText)
                Spacer()
            }
            .padding(8)
            .background(color)
        }
    }
    .background(Color.fjCanvas)
}

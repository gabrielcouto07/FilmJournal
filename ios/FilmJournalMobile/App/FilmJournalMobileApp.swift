import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

@main
struct FilmJournalMobileApp: App {
    /// Uma única instância para o app inteiro — troque `.localhost` por `.lan(host:)` ou
    /// `.production(host:)` (ver `Kit/Environment/AppConfig.swift`) para apontar para outro backend.
    private let api: FilmJournalAPI
    @StateObject private var session: SessionController
    @StateObject private var root = RootCoordinator()

    init() {
        let api = FilmJournalAPI(config: .localhost)
        self.api = api
        _session = StateObject(wrappedValue: SessionController(auth: api.auth))
        FJTopBarAppearance.install()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(root)
                .environment(\.filmJournalAPI, api)
                // O web força tema escuro incondicionalmente (`color-scheme: dark` em
                // globals.css) e usa o dourado (`--accent`) como cor de destaque padrão —
                // replicamos os dois aqui. Quando o Perfil ler `AppSettings.theme`/`accentColor`
                // reais, isso pode evoluir para dinâmico via `.preferredColorScheme`/`.tint`.
                .tint(Color.fjAccent)
                .preferredColorScheme(.dark)
        }
    }
}

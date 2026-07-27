import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

@main
struct FilmJournalMobileApp: App {
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
                // Tema fixo por enquanto; virá de `AppSettings.theme`/`accentColor` quando o Perfil os expor.
                .tint(Color.fjAccent)
                .preferredColorScheme(.dark)
        }
    }
}

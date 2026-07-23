import SwiftUI
import Kit

/// `FilmJournalAPI` não é `ObservableObject` (é um container de dependências estático, não
/// estado observável) — por isso entra via `@Environment` com uma chave própria, enquanto
/// `SessionController`/`RootCoordinator` entram como `@EnvironmentObject` (ver `FilmJournalMobileApp`).
private struct FilmJournalAPIKey: EnvironmentKey {
    static let defaultValue: FilmJournalAPI = FilmJournalAPI(config: .localhost)
}

public extension EnvironmentValues {
    var filmJournalAPI: FilmJournalAPI {
        get { self[FilmJournalAPIKey.self] }
        set { self[FilmJournalAPIKey.self] = newValue }
    }
}

/// Convenção usada em toda tela: leia `@Environment(\.filmJournalAPI) private var api` no
/// `View` e passe o service concreto para o `ViewModel` explicitamente (em `.task` ou em uma
/// ação de botão) — os `ViewModel`s não guardam `Environment` porque não é populado a tempo
/// dentro de `init()`. Ex.:
///
/// ```swift
/// struct DiaryView: View {
///     @Environment(\.filmJournalAPI) private var api
///     @StateObject private var viewModel = DiaryViewModel()
///     var body: some View {
///         content.task { await viewModel.load(logs: api.logs) }
///     }
/// }
/// ```

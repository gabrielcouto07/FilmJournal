import SwiftUI
import Kit

/// Container de dependências estático, não estado observável — daí `@Environment` em vez de `@EnvironmentObject`.
private struct FilmJournalAPIKey: EnvironmentKey {
    static let defaultValue: FilmJournalAPI = FilmJournalAPI(config: .localhost)
}

public extension EnvironmentValues {
    var filmJournalAPI: FilmJournalAPI {
        get { self[FilmJournalAPIKey.self] }
        set { self[FilmJournalAPIKey.self] = newValue }
    }
}

// A View lê o `api` do Environment e passa o service pro ViewModel; ViewModel não guarda
// Environment porque ele não está populado dentro do `init()`.

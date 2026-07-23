import SwiftUI
import CoordinatorKit
import DesignKit

/// Raiz da aba "Explorar" — agrupa Busca (`/search`) e Descobrir/pontos cegos (`/discover`).
/// Apresentada como sheet a partir de `HomeView` (não é mais uma aba do `TabView`), então
/// precisa do próprio botão de fechar — swipe-to-dismiss sozinho não é óbvio o bastante.
struct ExploreHomeView: View {
    @EnvironmentObject private var root: RootCoordinator
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        FJScreen("Explorar") {
            List {
                Button("Buscar filmes") { root.exploreRouter.push(.search) }
                Button("Descobrir pontos cegos") { root.exploreRouter.push(.discover(nil)) }
            }
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Fechar") { dismiss() }
            }
        }
    }
}

import SwiftUI
import CoordinatorKit
import DesignKit

// Vem como sheet da Home, daí o botão de fechar próprio: swipe-to-dismiss sozinho não é óbvio.
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

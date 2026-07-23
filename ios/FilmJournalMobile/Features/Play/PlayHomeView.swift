import SwiftUI
import CoordinatorKit
import DesignKit

/// Raiz da aba "Jogar" — agrupa o jogo Cine-Detetive e a Roleta. Apresentada como sheet a
/// partir de `HomeView` (não é mais uma aba do `TabView`), então precisa do próprio botão de
/// fechar — swipe-to-dismiss sozinho não é óbvio o bastante.
struct PlayHomeView: View {
    @EnvironmentObject private var root: RootCoordinator
    @Environment(\.dismiss) private var dismiss
    @State private var tab: PlayTab = .game

    var body: some View {
        FJScreen("Jogar") {
            VStack {
                Picker("", selection: $tab) {
                    Text("Jogo").tag(PlayTab.game)
                    Text("Roleta").tag(PlayTab.roulette)
                }
                .pickerStyle(.segmented)
                .padding()

                switch tab {
                case .game:
                    GameView()
                case .roulette:
                    RouletteView()
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Fechar") { dismiss() }
            }
        }
    }
}

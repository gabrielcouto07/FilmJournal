import SwiftUI
import CoordinatorKit
import DesignKit

// Vem como sheet da Home, daí o botão de fechar próprio: swipe-to-dismiss sozinho não é óbvio.
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

import SwiftUI
import CoordinatorKit
import DesignKit

// A API não diz se o usuário já fez o onboarding, então esta tela só abre pelo CTA na Home.
struct WelcomeView: View {
    @EnvironmentObject private var root: RootCoordinator

    var body: some View {
        FJScreen("Bem-vindo", displayMode: .inline) {
            VStack(spacing: Spacing.lg) {
                Spacer()
                Image(systemName: "hand.wave")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
                Text("Bem-vindo ao FilmJournal")
                    .font(.title2.bold())
                Text("Para começar seu Paladar, escolha até 5 filmes que você ama e dê uma nota para cada um. Usamos isso para recomendar filmes, diretores e gêneros parecidos com o seu gosto.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.lg)
                Spacer()
                Button("Escolher filmes favoritos") {
                    root.homeRouter.push(.onboardingPickFavorites)
                }
                .buttonStyle(.borderedProminent)
                .padding(.bottom, Spacing.lg)
            }
        }
    }
}

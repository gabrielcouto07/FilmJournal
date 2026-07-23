import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

struct ProfileView: View {
    @EnvironmentObject private var session: SessionController
    @EnvironmentObject private var root: RootCoordinator

    var body: some View {
        FJScreen("Perfil") {
        List {
            if let user = session.currentUser {
                Section {
                    VStack(alignment: .leading) {
                        Text(user.displayName ?? user.username).font(.headline)
                        Text("@\(user.username)").font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }

            Section {
                Button("Editar perfil") { root.profileRouter.push(.editProfile) }
                Button("Trocar e-mail") { root.profileRouter.push(.changeEmail) }
                Button("Trocar senha") { root.profileRouter.push(.changePassword) }
                Button("Preferências") { root.profileRouter.push(.appSettings) }
                Button("Importar do Letterboxd") { root.profileRouter.push(.importLetterboxd) }
            }

            Section {
                Button("Sair", role: .destructive) {
                    Task {
                        await session.logout()
                        root.resetAllStacks()
                    }
                }
                Button("Excluir conta", role: .destructive) { root.profileRouter.push(.deleteAccount) }
            }
        }
        }
    }
}

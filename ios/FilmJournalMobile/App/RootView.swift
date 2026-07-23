import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Raiz de navegação — decide entre restaurando sessão / login / app principal.
/// A sessão persiste via cookie (`HTTPCookieStorage`), então reabrir o app normalmente cai
/// direto em `.main` sem pedir login de novo.
struct RootView: View {
    @EnvironmentObject private var session: SessionController

    var body: some View {
        Group {
            if session.isRestoringSession {
                LoadingStateView(message: "Carregando sua sessão…")
            } else if session.isAuthenticated {
                MainTabView()
            } else {
                AuthFlowView()
            }
        }
        .task {
            await session.restoreSession()
        }
    }
}

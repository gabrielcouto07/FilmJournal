import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

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

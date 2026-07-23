import SwiftUI
import CoordinatorKit

struct AuthFlowView: View {
    @EnvironmentObject private var root: RootCoordinator

    var body: some View {
        RouterNavigationStack(router: root.authRouter) {
            LoginView()
        } destination: { route in
            switch route {
            case .login:
                LoginView()
            case .register:
                RegisterView()
            }
        }
    }
}

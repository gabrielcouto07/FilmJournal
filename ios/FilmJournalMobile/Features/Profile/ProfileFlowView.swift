import SwiftUI
import CoordinatorKit

struct ProfileFlowView: View {
    @EnvironmentObject private var root: RootCoordinator

    var body: some View {
        RouterNavigationStack(router: root.profileRouter) {
            ProfileView()
        } destination: { route in
            switch route {
            case .editProfile:
                EditProfileView()
            case .changeEmail:
                ChangeEmailView()
            case .changePassword:
                ChangePasswordView()
            case .appSettings:
                AppSettingsView()
            case .importLetterboxd:
                ImportLetterboxdView()
            case .deleteAccount:
                DeleteAccountView()
            }
        }
    }
}

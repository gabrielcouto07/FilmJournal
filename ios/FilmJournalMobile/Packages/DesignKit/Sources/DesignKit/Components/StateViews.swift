import SwiftUI

/// Estados genéricos de tela (carregando/vazio/erro) — placeholders estruturais para as telas
/// pré-prontas, já na paleta "cinema" do web (`fjText`/`fjTextSoft`/`fjMuted`/`fjDanger`). O
/// layout fino continua sendo responsabilidade do restante da UI.
public struct LoadingStateView: View {
    private let message: String?

    public init(message: String? = nil) {
        self.message = message
    }

    public var body: some View {
        VStack(spacing: Spacing.sm) {
            ProgressView().tint(.fjAccent)
            if let message {
                Text(message).font(.footnote).foregroundStyle(Color.fjTextSoft)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

public struct EmptyStateView: View {
    private let systemImage: String
    private let title: String
    private let message: String?

    public init(systemImage: String, title: String, message: String? = nil) {
        self.systemImage = systemImage
        self.title = title
        self.message = message
    }

    public var body: some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: systemImage).font(.largeTitle).foregroundStyle(Color.fjMuted)
            Text(title).font(.headline).foregroundStyle(Color.fjText)
            if let message {
                Text(message).font(.footnote).foregroundStyle(Color.fjTextSoft).multilineTextAlignment(.center)
            }
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

public struct ErrorStateView: View {
    private let message: String
    private let retry: (() -> Void)?

    public init(message: String, retry: (() -> Void)? = nil) {
        self.message = message
        self.retry = retry
    }

    public var body: some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: "exclamationmark.triangle").font(.largeTitle).foregroundStyle(Color.fjDanger)
            Text(message).font(.footnote).multilineTextAlignment(.center).foregroundStyle(Color.fjTextSoft)
            if let retry {
                Button("Tentar de novo", action: retry).tint(.fjAccent)
            }
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview("Loading") {
    LoadingStateView(message: "Carregando sua sessão…")
        .background(Color.fjCanvas)
}

#Preview("Empty") {
    EmptyStateView(
        systemImage: "book.closed",
        title: "Nenhuma sessão ainda",
        message: "Registre um filme para começar seu diário."
    )
    .background(Color.fjCanvas)
}

#Preview("Error") {
    ErrorStateView(message: "Não foi possível carregar seus filmes.") {}
        .background(Color.fjCanvas)
}

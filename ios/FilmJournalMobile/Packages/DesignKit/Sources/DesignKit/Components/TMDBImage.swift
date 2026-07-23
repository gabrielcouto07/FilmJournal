import SwiftUI

/// Tamanhos de imagem servidos pelo TMDB — mesma base usada no backend (`src/lib/tmdb.ts`).
public enum TMDBImageSize: String {
    case posterSmall = "w342"
    case posterMedium = "w500"
    case backdropMedium = "w780"
    case backdropLarge = "w1280"
    case profile = "w185"
    case original
}

public enum TMDBImageURL {
    private static let base = "https://image.tmdb.org/t/p"

    /// `path` é o `poster_path`/`backdrop_path`/`profile_path` crus do TMDB (ex. `/abc123.jpg`).
    public static func url(path: String?, size: TMDBImageSize) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        return URL(string: "\(base)/\(size.rawValue)\(path)")
    }
}

/// Pôster/backdrop com placeholder — o restante do estilo (bordas, sombra, aspect ratio exato)
/// fica a cargo da UI final; aqui só garantimos que toda tela já carregue imagem de verdade.
public struct RemotePosterImage: View {
    private let path: String?
    private let size: TMDBImageSize

    public init(path: String?, size: TMDBImageSize = .posterMedium) {
        self.path = path
        self.size = size
    }

    public var body: some View {
        AsyncImage(url: TMDBImageURL.url(path: path, size: size)) { phase in
            switch phase {
            case .success(let image):
                image.resizable().aspectRatio(contentMode: .fill)
            case .failure:
                placeholder
            case .empty:
                placeholder
            @unknown default:
                placeholder
            }
        }
    }

    /// Espelha `.poster-fallback` do web: gradiente quente escuro + marca dourada central.
    private var placeholder: some View {
        LinearGradient(colors: [Color(hex: "#1f1a12"), Color(hex: "#0d0d0d")], startPoint: .top, endPoint: .bottom)
            .overlay(Image(systemName: "film").foregroundStyle(Color.fjAccent.opacity(0.7)))
    }
}

#Preview("Sem imagem (placeholder)") {
    RemotePosterImage(path: nil)
        .frame(width: 160, height: 240)
        .background(Color.fjCanvas)
}

#Preview("Backdrop") {
    RemotePosterImage(path: "/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg", size: .backdropMedium)
        .frame(width: 320, height: 180)
        .background(Color.fjCanvas)
}

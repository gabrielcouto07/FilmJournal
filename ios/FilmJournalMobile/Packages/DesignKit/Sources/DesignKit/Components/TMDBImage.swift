import SwiftUI

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

    /// `path` é o valor cru do TMDB, com a barra inicial (ex. `/abc123.jpg`).
    public static func url(path: String?, size: TMDBImageSize) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        return URL(string: "\(base)/\(size.rawValue)\(path)")
    }
}

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

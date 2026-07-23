// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "DesignKit",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "DesignKit", targets: ["DesignKit"])
    ],
    targets: [
        .target(name: "DesignKit")
    ]
)

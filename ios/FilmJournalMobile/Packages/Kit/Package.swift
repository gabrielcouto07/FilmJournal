// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "Kit",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "Kit", targets: ["Kit"])
    ],
    targets: [
        .target(name: "Kit"),
        .testTarget(name: "KitTests", dependencies: ["Kit"])
    ]
)

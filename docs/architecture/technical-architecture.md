# Technical Architecture

## System Overview

```mermaid
graph TB
    subgraph "Input Layer"
        A[Original Images] -->|PNG/JPEG/GIF/WebP| B[File System Watcher]
    end
    
    subgraph "Processing Layer"
        B --> C{Image Processor}
        C -->|Analyze| D[Format Detection]
        C -->|Optimize| E[Sharp Engine]
        D --> E
        E --> F[Quality Settings]
        F --> G[Output Generator]
    end
    
    subgraph "Output Layer"
        G -->|WebP 85%| H[WebP Files]
        G -->|AVIF 80%| I[AVIF Files]
        G -->|PNG/JPEG| J[Fallback Files]
        G -->|Thumbnail| K[Thumbnail Files]
    end
    
    subgraph "Distribution"
        H --> L[GitHub CDN]
        I --> L
        J --> L
        K --> L
        L --> M[raw.githubusercontent.com]
    end
```

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant FileSystem
    participant Watcher
    participant Optimizer
    participant Sharp
    participant CDN
    
    User->>FileSystem: Drop image in original/
    FileSystem->>Watcher: File change detected
    Watcher->>Optimizer: Process new image
    Optimizer->>Sharp: Load image
    Sharp->>Sharp: Detect format
    Sharp->>Sharp: Apply optimizations
    Sharp->>FileSystem: Save multiple formats
    FileSystem->>CDN: Git push
    CDN->>User: Serve optimized images
```

## Component Architecture

```mermaid
classDiagram
    class ImageOptimizer {
        -gitLfsDetector: GitLfsDetector
        -gitLfsPuller: GitLfsPuller
        -timestampChecker: FileTimestampChecker
        -imageProcessor: ImageProcessor
        -pathGenerator: OutputPathGenerator
        +optimizeImage(inputPath, filename, options)
    }
    
    class ImageProcessor {
        -sharp: Sharp
        +processImage(inputPath, outputConfigs)
    }
    
    class GitLfsDetector {
        -fileReader: FileReader
        +isGitLfsPointer(filePath): boolean
    }
    
    class FileTimestampChecker {
        -fileStats: FileStats
        +shouldProcess(inputPath, outputPaths, force): boolean
    }
    
    class OutputPathGenerator {
        -outputDir: string
        +generatePaths(filename): OutputPaths
        +getProcessingConfigs(filename, paths): ProcessingConfig[]
    }
    
    ImageOptimizer --> ImageProcessor
    ImageOptimizer --> GitLfsDetector
    ImageOptimizer --> FileTimestampChecker
    ImageOptimizer --> OutputPathGenerator
```

## Module Design

```mermaid
graph LR
    subgraph "Core Modules"
        A[optimize-images.js] --> B[Sharp Processor]
        A --> C[File Watcher]
        A --> D[Stats Reporter]
    end
    
    subgraph "Utilities"
        B --> E[Format Detector]
        B --> F[Quality Manager]
        C --> G[Path Resolver]
    end
    
    subgraph "External Dependencies"
        B --> H[sharp]
        C --> I[chokidar]
        A --> J[fs/promises]
    end
```

## Performance Optimization Strategy

```mermaid
graph TD
    A[Input Image] --> B{Size Check}
    B -->|>2000px| C[Resize to 2000px]
    B -->|<=2000px| D[Keep Original Size]
    C --> E[Multi-Format Export]
    D --> E
    E --> F[WebP Export]
    E --> G[AVIF Export]
    E --> H[Fallback Export]
    F --> I[Quality Optimization]
    G --> I
    H --> I
    I --> J[File Size Comparison]
    J --> K[Choose Optimal Format]
```

## Docker Architecture

The project is fully dockerized for consistency across environments:

- **Production Image**: Alpine-based, minimal dependencies, optimized for running the optimization script
- **Test Image**: Includes dev dependencies for running the test suite
- **Volume Mounts**: 
  - `./original` → `/app/original` (read-only)
  - `./optimized` → `/app/optimized` (read-write)
  - `./.git` → `/app/.git` (for Git LFS operations)
- **Benefits**:
  - No local Node.js installation required
  - Consistent Sharp/libvips versions across all platforms
  - Isolated environment prevents dependency conflicts
  - Same environment in CI/CD and local development

## Technology Stack

- **Runtime**: Node.js (v16+)
- **Image Processing**: Sharp (libvips-based)
- **Version Control**: Git with LFS
- **CDN**: GitHub raw.githubusercontent.com
- **Build Tools**: npm scripts
- **File Watching**: Chokidar
- **Testing**: Jest
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions

## Design Principles

1. **Incremental Processing**: Only process changed images
2. **Format Diversity**: Support multiple modern formats (WebP, AVIF)
3. **Progressive Enhancement**: Provide fallbacks for older browsers
4. **Performance First**: Optimize for smallest file sizes
5. **Privacy Conscious**: Strip EXIF metadata
6. **Modularity**: Single Responsibility Principle throughout
7. **Testability**: Dependency injection for easy testing
8. **Consistency**: Docker ensures same environment everywhere
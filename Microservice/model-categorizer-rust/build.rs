fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .build_server(true)
        .compile(
            &["src/proto/models.proto"],
            &["src/proto"],
        )?;
    Ok(())
} 
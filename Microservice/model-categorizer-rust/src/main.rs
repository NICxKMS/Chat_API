use tonic::transport::Server;
use tonic_health::server::health_reporter;
use tracing::info;
use tracing_subscriber;

mod handlers;
mod classifiers;
mod models;
mod proto;
use handlers::ModelClassificationHandler;
use proto::modelservice::model_classification_service_server::ModelClassificationServiceServer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing subscriber for logging
    tracing_subscriber::fmt::init();

    // Read port from environment or use default
    let port = std::env::var("PORT").unwrap_or_else(|_| "8090".to_string());
    let addr = format!("0.0.0.0:{}", port).parse()?;

    // Set up health reporter
    let (mut health_reporter, health_service) = tonic_health::server::health_reporter();
    health_reporter
        .set_serving::<ModelClassificationServiceServer<ModelClassificationHandler>>()
        .await;

    // Create service handler
    let classification_service = ModelClassificationServiceServer::new(ModelClassificationHandler::default());

    tracing::info!("Model Classification Service starting on {}", addr);

    // Start gRPC server with graceful shutdown on Ctrl+C
    Server::builder()
        .add_service(health_service)
        .add_service(classification_service)
        .serve_with_shutdown(addr, async {
            tokio::signal::ctrl_c().await.expect("Failed to listen for shutdown signal");
            tracing::info!("Shutting down gRPC server...");
        })
        .await?;

    Ok(())
}

use anyhow::Context;
use serde_json::{json, Value};
use std::path::PathBuf;
use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let data_dir = std::env::args()
        .nth(1)
        .context("usage: mmgraph-surreal-export <memory-mcp-data-dir>")?;

    let db_path = PathBuf::from(data_dir).join("db");
    let db: Surreal<Db> = Surreal::new::<SurrealKv>(db_path).await?;
    db.use_ns("memory").use_db("main").await?;

    let memories = read_table(&db, "memories").await?;
    let entities = read_table(&db, "entities").await?;
    let relations = read_table(&db, "relations").await?;
    let code_symbols = read_table(&db, "code_symbols").await?;
    let symbol_relation = read_table(&db, "symbol_relation").await?;

    let payload = json!({
        "memories": memories,
        "entities": entities,
        "relations": relations,
        "code_symbols": code_symbols,
        "symbol_relation": symbol_relation,
    });

    println!("{}", serde_json::to_string(&payload)?);
    Ok(())
}

async fn read_table(db: &Surreal<Db>, table: &str) -> anyhow::Result<Vec<Value>> {
    let query = format!("SELECT * FROM {}", table);
    let mut response = db.query(query).await?;
    let rows: Vec<Value> = response.take(0).unwrap_or_default();
    Ok(rows)
}

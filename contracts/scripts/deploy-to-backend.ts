import { ethers } from "hardhat";

async function main() {
    const backend = process.env.BACKEND_BASE || "http://localhost:8080";
    const template = process.env.TEMPLATE || "SimpleRegistry"; // or SampleERC20
    const name = process.env.NAME || template;
    const constructorArgsEnv = process.env.ARGS || "[]";
    const args = JSON.parse(constructorArgsEnv);

    let factoryName = template;
    if (template === "SampleERC20") factoryName = "SampleERC20";
    const [signer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory(factoryName);
    const contract = await Factory.deploy(...args);
    await contract.deployed();
    const address = await contract.getAddress();
    const abi = (await ethers.getArtifact(factoryName)).abi;
    const txHash = contract.deploymentTransaction()?.hash || "";

    const res = await fetch(`${backend}/api/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name,
            address,
            abi: JSON.stringify(abi),
            network: "anvil",
            txHash,
        }),
    });
    if (!res.ok) {
        throw new Error(`backend save failed: ${res.status}`);
    }
    console.log(`Deployed ${name} at ${address}, saved to backend.`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

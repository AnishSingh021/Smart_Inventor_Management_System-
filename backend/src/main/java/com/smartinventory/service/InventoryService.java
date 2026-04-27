package com.smartinventory.service;

import com.smartinventory.entity.InventoryTransaction;
import com.smartinventory.entity.Product;
import com.smartinventory.entity.User;
import com.smartinventory.repository.InventoryTransactionRepository;
import com.smartinventory.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final ProductRepository productRepository;
    private final InventoryTransactionRepository transactionRepository;
    private final PredictionService predictionService;

    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    public Product getProductById(Long id) {
        return productRepository.findById(id).orElseThrow(() -> new RuntimeException("Product not found"));
    }

    public Product addProduct(Product product) {
        return productRepository.save(product);
    }

    @Transactional
    public Product processStockTransaction(Long productId, Integer quantity, InventoryTransaction.TransactionType type, String reason, User user) {
        Product product = getProductById(productId);

        if (type == InventoryTransaction.TransactionType.OUT) {
            if (product.getCurrentStock() < quantity) {
                throw new RuntimeException("Insufficient stock");
            }
            product.setCurrentStock(product.getCurrentStock() - quantity);
        } else {
            product.setCurrentStock(product.getCurrentStock() + quantity);
        }

        productRepository.save(product);

        InventoryTransaction transaction = new InventoryTransaction();
        transaction.setProduct(product);
        transaction.setQuantity(quantity);
        transaction.setType(type);
        transaction.setReason(reason);
        transaction.setPerformedBy(user);
        transactionRepository.save(transaction);

        // Update prediction if it's an OUT transaction
        if (type == InventoryTransaction.TransactionType.OUT) {
            predictionService.updatePredictionForProduct(product);
        }

        return product;
    }
}

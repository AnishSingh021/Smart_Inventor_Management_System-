package com.smartinventory.service;

import com.smartinventory.entity.InventoryTransaction;
import com.smartinventory.entity.Product;
import com.smartinventory.repository.InventoryTransactionRepository;
import com.smartinventory.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PredictionService {

    private final ProductRepository productRepository;
    private final InventoryTransactionRepository transactionRepository;

    /**
     * Calculates the Average Daily Consumption (ADC) based on the last 30 days of OUT transactions.
     * Updates the predicted depletion date.
     */
    @Transactional
    public void updatePredictionForProduct(Product product) {
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        List<InventoryTransaction> recentOutTransactions = transactionRepository
                .findByProductIdAndTransactionDateAfter(product.getId(), thirtyDaysAgo)
                .stream()
                .filter(t -> t.getType() == InventoryTransaction.TransactionType.OUT)
                .toList();

        if (recentOutTransactions.isEmpty()) {
            product.setAverageDailyConsumption(0.0);
            product.setPredictedDepletionDate(null);
            productRepository.save(product);
            return;
        }

        int totalConsumed = recentOutTransactions.stream()
                .mapToInt(InventoryTransaction::getQuantity)
                .sum();

        // Find the oldest transaction in this 30 day window to calculate accurate days
        LocalDateTime oldestTransactionDate = recentOutTransactions.stream()
                .map(InventoryTransaction::getTransactionDate)
                .min(LocalDateTime::compareTo)
                .orElse(thirtyDaysAgo);

        long daysElapsed = ChronoUnit.DAYS.between(oldestTransactionDate, LocalDateTime.now());
        if (daysElapsed == 0) daysElapsed = 1; // Avoid division by zero

        double adc = (double) totalConsumed / daysElapsed;
        product.setAverageDailyConsumption(adc);

        // Predict Depletion Date
        if (adc > 0) {
            int currentStock = product.getCurrentStock() != null ? product.getCurrentStock() : 0;
            long daysUntilDepletion = (long) (currentStock / adc);
            LocalDateTime predictedDate = LocalDateTime.now().plusDays(daysUntilDepletion);
            product.setPredictedDepletionDate(predictedDate);
        } else {
            product.setPredictedDepletionDate(null);
        }

        productRepository.save(product);
    }

    /**
     * Nightly job to recalculate predictions for all products
     */
    @Scheduled(cron = "0 0 2 * * ?") // Every day at 2 AM
    @Transactional
    public void runNightlyPredictions() {
        List<Product> products = productRepository.findAll();
        for (Product product : products) {
            updatePredictionForProduct(product);
        }
    }
}

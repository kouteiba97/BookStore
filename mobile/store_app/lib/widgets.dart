import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'models.dart';
import 'theme.dart';

class BrandLogo extends StatelessWidget {
  final double size;
  const BrandLogo({super.key, this.size = 40});
  @override
  Widget build(BuildContext context) =>
      SvgPicture.asset('assets/logo.svg', width: size, height: size);
}

/// Inventory badge — same wording as the web book card.
class AvailabilityChip extends StatelessWidget {
  final Inventory? inventory;
  const AvailabilityChip({super.key, this.inventory});

  @override
  Widget build(BuildContext context) {
    final status = inventory?.status ?? 'on_request';
    final (label, bg, fg) = switch (status) {
      'available' => ('متوفر', const Color(0xFFE3F0E7), AppColors.success),
      'rare' => ('نادر', AppColors.goldLight, const Color(0xFF8A6620)),
      _ => ('عند الطلب', AppColors.secondary, AppColors.mutedForeground),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
    );
  }
}

class BookCover extends StatelessWidget {
  final String? imageUrl;
  final double? width;
  final double? height;
  final BorderRadius? radius;
  const BookCover({super.key, this.imageUrl, this.width, this.height, this.radius});

  @override
  Widget build(BuildContext context) {
    final r = radius ?? BorderRadius.circular(12);
    final placeholder = Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: r,
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF2C5443), AppColors.primary],
        ),
      ),
      child: Center(child: Icon(Icons.menu_book_rounded, color: AppColors.goldLight.withValues(alpha: 0.8), size: 36)),
    );
    if (imageUrl == null || imageUrl!.isEmpty) return placeholder;
    return ClipRRect(
      borderRadius: r,
      child: CachedNetworkImage(
        imageUrl: imageUrl!,
        width: width,
        height: height,
        fit: BoxFit.cover,
        placeholder: (_, _) => placeholder,
        errorWidget: (_, _, _) => placeholder,
      ),
    );
  }
}

String priceLabel(num? price) => price == null ? '' : '${price.toStringAsFixed(0)} د.ج';

class BookCard extends StatelessWidget {
  final Book book;
  final VoidCallback onTap;
  const BookCard({super.key, required this.book, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 3 / 4,
              child: BookCover(imageUrl: book.imageUrl, radius: BorderRadius.zero),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(book.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: heading(size: 15, weight: FontWeight.w700)),
                  if (book.author != null) ...[
                    const SizedBox(height: 2),
                    Text(book.author!.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
                  ],
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      AvailabilityChip(inventory: book.inventory),
                      if (book.price != null)
                        Text(priceLabel(book.price),
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.primary)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String title;
  final Widget? trailing;
  const SectionTitle(this.title, {super.key, this.trailing});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(children: [
              Container(width: 4, height: 22, decoration: BoxDecoration(color: AppColors.gold, borderRadius: BorderRadius.circular(2))),
              const SizedBox(width: 8),
              Text(title, style: heading(size: 20)),
            ]),
            if (trailing != null) trailing!,
          ],
        ),
      );
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key});
  @override
  Widget build(BuildContext context) =>
      const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator(color: AppColors.gold)));
}

class ErrorView extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;
  const ErrorView({super.key, required this.error, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 40, color: AppColors.mutedForeground),
              const SizedBox(height: 12),
              const Text('تعذّر الاتصال بالخادم', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              const Text('قد يستغرق الخادم لحظات ليستيقظ — أعد المحاولة',
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
              const SizedBox(height: 16),
              OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('إعادة المحاولة')),
            ],
          ),
        ),
      );
}

class EmptyView extends StatelessWidget {
  final String message;
  const EmptyView(this.message, {super.key});
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.auto_stories_outlined, size: 40, color: AppColors.mutedForeground),
            const SizedBox(height: 12),
            Text(message, style: const TextStyle(color: AppColors.mutedForeground)),
          ]),
        ),
      );
}

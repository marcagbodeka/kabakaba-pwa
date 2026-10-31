/** Conditions d’utilisation étudiant. Pas d’identité juridique inventée. */
export default function TermsText() {
  return (
    <div className="terms-doc">
      <p>Ces conditions s’appliquent quand tu utilises kabakaba pour commander sur le campus.</p>

      <h3>Tickets</h3>
      <p>
        Un ticket sert à payer un repas dans une cantine. Ce n’est pas de l’argent liquide, et tu ne
        peux pas le retirer vers Mobile Money.
      </p>

      <h3>Recharge</h3>
      <p>
        Tu recharges par Flooz ou Mixx. Les frais s’affichent avant que tu paies. Ton code secret
        reste sur le réseau de l’opérateur, jamais dans kabakaba. Une recharge réussie n’est pas
        reversée sur Mobile Money.
      </p>

      <h3>Commande immédiate</h3>
      <p>
        Les tickets sont débités dès que la commande est confirmée, au prix de la cantine à cet
        instant.
      </p>

      <h3>Commande programmée</h3>
      <p>
        Tu peux programmer un repas entre 15 minutes et 24 heures à l’avance, avec au plus cinq
        commandes en attente. Rien n’est débité avant l’heure choisie. Tu peux l’annuler sans frais
        tant qu’elle n’a pas démarré. Si elle ne peut pas partir, aucun ticket n’est pris. Le prix
        retenu est celui du moment où la commande démarre.
      </p>

      <h3>Paiement de la cantine</h3>
      <p>
        La cantine est payée quand elle marque la commande prête. Un ticket vaut un franc CFA.
        kabakaba ne prend pas de commission sur cette vente.
      </p>

      <h3>Annulation</h3>
      <p>
        Tant que la commande n’est pas prête, tu peux annuler une commande confirmée : tes tickets
        reviennent. La cantine peut aussi annuler une commande confirmée ou en préparation. Une
        fois la commande prête ou récupérée, elle ne s’annule plus.
      </p>

      <h3>Commande non récupérée</h3>
      <p>
        Si tu ne viens pas chercher une commande prête dans l’heure, elle est signalée comme non
        récupérée. Elle n’est pas remboursée : la cantine a déjà été payée.
      </p>

      <h3>Parrainage</h3>
      <p>Le parrain reçoit 100 tickets, une seule fois, à la première recharge réussie du filleul.</p>

      <h3>Aide</h3>
      <p>Une question ou un désaccord se règle depuis le centre d’aide, dans ton profil.</p>
    </div>
  );
}
